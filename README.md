# EmailClaude

An email-to-AI response system that automatically replies to emails with hilariously formal, Victorian-style responses powered by Claude AI.

## Features

- 📧 **Automatic Email Processing**: Receives emails via SendGrid webhook
- 🤖 **Claude AI Integration**: Generates responses using Anthropic's Claude API
- 🎩 **Victorian Formality**: Responds with absurdly formal, pompous language
- 🔒 **Webhook Security**: Optional SendGrid signature verification
- 📨 **Auto-Reply**: Sends responses back via SendGrid API
- 👤 **Personalized**: Addresses senders by name with excessive courtesy

## Setup

### Prerequisites

1. **SendGrid Account** - For receiving and sending emails
2. **Anthropic API Key** - For Claude AI responses
3. **Domain/Subdomain** - For receiving emails (e.g., `claude@yourdomain.com`)
4. **Webhook Tunnel** - ngrok, Cloudflare Tunnel, or similar

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/emailclaude.git
cd emailclaude
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
SENDGRID_API_KEY=your_sendgrid_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
BASE_URL=https://your-tunnel-domain.com/
FROM_EMAIL=claude@yourdomain.com
PORT=8000
# Optional: For webhook security
SENDGRID_WEBHOOK_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----
```

### SendGrid Configuration

1. **Domain Authentication**:
   - Go to SendGrid Dashboard → Settings → Sender Authentication
   - Authenticate your domain for sending emails

2. **MX Record Setup**:
   - Point your domain/subdomain's MX record to `mx.sendgrid.net`
   - Example: `claude.yourdomain.com` → `mx.sendgrid.net`

3. **Inbound Parse Setup**:
   - Go to SendGrid Dashboard → Settings → Inbound Parse
   - Add your domain (e.g., `claude.yourdomain.com`)
   - Set webhook URL to `https://your-tunnel-domain.com/sendgrid/webhook`

4. **Optional Security**:
   - In Inbound Parse settings, enable signature verification
   - Add the public key to your `.env` file

### Webhook Tunnel Setup

Choose one of these options to expose your local server:

**Option A: Cloudflare Tunnel**
```bash
# Install cloudflared and setup tunnel
cloudflared tunnel create emailclaude
cloudflared tunnel route dns emailclaude your-subdomain.yourdomain.com
cloudflared tunnel run emailclaude
```

**Option B: ngrok**
```bash
# Install ngrok and expose port
ngrok http 8000
# Use the https URL in your SendGrid webhook settings
```

## Usage

1. Start the server:
```bash
npm start
# or for development
node server.js
```

2. Send an email to your configured address (e.g., `claude@yourdomain.com`)

3. Watch the magic happen! Claude will respond with absurdly formal language like:
   > "My Most Distinguished and Illustrious Correspondent of Unparalleled Excellence..."

## Example Response

Send: `Hey, how are you?`

Receive:
> My Most Esteemed and Venerated Mr. [Your Name], Paragon of Epistolary Excellence,
>
> I find myself positively rapturous with unbounded elation upon receiving your most gracious correspondence... [continues in ridiculously formal Victorian style]
>
> Your perpetually genuflecting computational valet, forever basking in the radiant glow of your magnificent presence

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | Yes | Your SendGrid API key |
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic Claude API key |
| `BASE_URL` | Yes | Your webhook tunnel URL (with trailing slash) |
| `FROM_EMAIL` | Yes | Authenticated sender email address |
| `PORT` | No | Server port (default: 8000) |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | No | Public key for webhook signature verification |

## Security

- Add `SENDGRID_WEBHOOK_PUBLIC_KEY` to verify webhooks are from SendGrid
- The `.env` file is ignored by git to protect your API keys
- Consider rate limiting for production use

## Development

The server logs all webhook activity for debugging:
```bash
node server.js
# Server running on port 8000
# Webhook URL: https://your-domain.com/sendgrid/webhook
```

## Troubleshooting

**Emails not being received?**
- Check MX record configuration
- Verify SendGrid Inbound Parse settings
- Ensure webhook URL is accessible

**No responses being sent?**
- Check SendGrid API key and domain authentication
- Verify `FROM_EMAIL` is properly authenticated in SendGrid

**Webhook failing?**
- Check server logs for errors
- Verify tunnel is running and accessible
- Test webhook URL manually

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details