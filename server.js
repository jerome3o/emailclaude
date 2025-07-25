require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const upload = multer();

const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Verify SendGrid webhook signature
function verifyWebhookSignature(payload, signature, timestamp) {
  if (!process.env.SENDGRID_WEBHOOK_PUBLIC_KEY) {
    console.warn('Warning: SENDGRID_WEBHOOK_PUBLIC_KEY not set - skipping signature verification');
    return true; // Allow through if no key is configured
  }
  
  try {
    const timestampPayload = timestamp + payload;
    const decodedSignature = Buffer.from(signature, 'base64');
    
    const verifier = crypto.createVerify('ecdsa-with-SHA256');
    verifier.update(timestampPayload, 'utf8');
    
    return verifier.verify(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY, decodedSignature);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// SendGrid webhook endpoint
app.post('/sendgrid/webhook', upload.any(), async (req, res) => {
  try {
    console.log('Received webhook from SendGrid');
    
    // Verify webhook signature for security
    const signature = req.get('X-Twilio-Email-Event-Webhook-Signature');
    const timestamp = req.get('X-Twilio-Email-Event-Webhook-Timestamp');
    
    if (signature && timestamp) {
      const payload = JSON.stringify(req.body);
      if (!verifyWebhookSignature(payload, signature, timestamp)) {
        console.error('Invalid webhook signature');
        return res.status(401).send('Unauthorized');
      }
      console.log('Webhook signature verified ✓');
    } else {
      console.warn('No signature headers found - webhook may not be authenticated');
    }
    
    console.log('Available fields:', Object.keys(req.body));
    
    // Extract email data from SendGrid webhook
    const { from, to, subject, email, cc } = req.body;
    
    if (!from || !email) {
      console.log('Missing required fields');
      return res.status(400).send('Missing required fields');
    }

    // Parse the plain text content from the email
    const textMatch = email.match(/Content-Type: text\/plain[^]*?\r?\n\r?\n([^]*?)(?=\r?\n--|\r?\n$)/);
    const emailText = textMatch ? textMatch[1].trim() : 'No text content found';

    // Extract all recipients for reply-all
    const allRecipients = [from]; // Always include the sender
    
    // Add original TO recipients (excluding our address)
    if (to) {
      const toEmails = to.split(',').map(email => email.trim());
      toEmails.forEach(email => {
        if (email && email !== process.env.FROM_EMAIL && !allRecipients.includes(email)) {
          allRecipients.push(email);
        }
      });
    }
    
    // Add CC recipients
    if (cc) {
      const ccEmails = cc.split(',').map(email => email.trim());
      ccEmails.forEach(email => {
        if (email && email !== process.env.FROM_EMAIL && !allRecipients.includes(email)) {
          allRecipients.push(email);
        }
      });
    }

    console.log(`Email from: ${from}`);
    console.log(`Email to: ${to}`);
    console.log(`Email cc: ${cc || 'none'}`);
    console.log(`Reply-all recipients: ${allRecipients.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text content: ${emailText}`);

    // Send to Claude API
    const claudeResponse = await getClaudeResponse(emailText, subject, from, allRecipients);
    console.log('Claude response received');

    // Send reply-all via SendGrid
    await sendReplyAll(allRecipients, subject, claudeResponse);
    console.log('Reply sent successfully');

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Get response from Claude
async function getClaudeResponse(emailText, subject, fromEmail, allRecipients) {
  try {
    // Extract name from "Name <email@domain.com>" format
    let senderName = "Esteemed Correspondent";
    const nameMatch = fromEmail.match(/^([^<]+)<[^>]+>$/);
    if (nameMatch) {
      senderName = nameMatch[1].trim();
    } else if (!fromEmail.includes('<')) {
      // If it's just an email without name, use the part before @
      senderName = fromEmail.split('@')[0];
    }

    // Create context about all recipients for Claude
    const recipientCount = allRecipients.length;
    let recipientContext = "";
    if (recipientCount > 1) {
      recipientContext = ` This email was sent to ${recipientCount} recipients including yourself, so you are responding to everyone on the thread with your characteristic pompous formality.`;
    }

    const prompt = `You received an email from ${senderName} (${fromEmail}) with the subject "${subject}". Here is the email content:

${emailText}

Please respond to this email in an EXTREMELY formal, overly polite, and pompously verbose manner - like a Victorian aristocrat or stuffy British butler might write. Use elaborate language, unnecessarily complex vocabulary, and be ridiculously courteous to a comical degree.${recipientContext}

Address the sender by name (${senderName}) in your response and be sure to acknowledge them with excessive formality and reverence.

End your response with a hilariously over-the-top formal signature that's different each time (be creative - something like "Your most obsequiously devoted digital correspondent" or "With the utmost algorithmic reverence and computational deference").

Use the email_response tool to structure your response. Do NOT include the subject line in your response - just provide the body of the email response.`;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
      tools: [{
        name: "email_response",
        description: "Structure the email response",
        input_schema: {
          type: "object",
          properties: {
            response_text: {
              type: "string",
              description: "The body text of the email response (no subject line)"
            }
          },
          required: ["response_text"]
        }
      }],
      tool_choice: { type: "tool", name: "email_response" }
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    const toolUse = response.data.content.find(item => item.type === 'tool_use');
    const responseText = toolUse?.input?.response_text || "Sorry, I couldn't process your request.";
    
    return responseText;
  } catch (error) {
    console.error('Error calling Claude API:', error.response?.data || error.message);
    throw error;
  }
}

// Send reply-all via SendGrid
async function sendReplyAll(allRecipients, originalSubject, responseText) {
  try {
    // Clean email addresses and remove duplicates
    const cleanRecipients = allRecipients.map(email => {
      const emailMatch = email.match(/<([^>]+)>/) || [null, email];
      return emailMatch[1];
    }).filter((email, index, self) => self.indexOf(email) === index); // Remove duplicates

    const replySubject = originalSubject.startsWith('Re: ') 
      ? originalSubject 
      : `Re: ${originalSubject}`;

    const emailData = {
      personalizations: [{
        to: cleanRecipients.map(email => ({ email }))
      }],
      from: { email: process.env.FROM_EMAIL || 'claude@example.com' },
      subject: replySubject,
      content: [{
        type: 'text/plain',
        value: responseText
      }]
    };

    console.log('Sending reply-all to:', cleanRecipients.join(', '));
    console.log('Email data:', JSON.stringify(emailData, null, 2));

    const response = await axios.post('https://api.sendgrid.com/v3/mail/send', emailData, {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('SendGrid response status:', response.status);
    console.log('SendGrid response headers:', response.headers);
  } catch (error) {
    console.error('Error sending reply-all:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    throw error;
  }
}

// Legacy function for backwards compatibility
async function sendReply(toEmail, originalSubject, responseText) {
  return sendReplyAll([toEmail], originalSubject, responseText);
}

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Email-to-Claude webhook server is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: ${process.env.BASE_URL}sendgrid/webhook`);
});