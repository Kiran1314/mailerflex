import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import Sender from '../models/Sender.js';
import EmailMessage from '../models/EmailMessage.js';

export const pollIncomingEmails = async () => {
  try {
    const senders = await Sender.find();
    
    for (const sender of senders) {
      if (!sender.incomingHost || !sender.password) continue;

      const client = new ImapFlow({
        host: sender.incomingHost.replace('pop.', 'imap.'),
        port: 993,
        secure: true,
        auth: {
          user: sender.email,
          pass: sender.password
        },
        tls: { rejectUnauthorized: false },
        logger: false,
        socketTimeout: 15000 // 15 seconds timeout safeguard
      });

      // Prevent unhandled error events from crashing the server process
      client.on('error', (err) => {
        console.error(`IMAP connection error for ${sender.email}:`, err.message);
      });

      try {
        await client.connect();
        
        const lock = await client.getMailboxLock('INBOX');
        try {
          for await (const message of client.fetch({ seen: false }, { uid: true, source: true })) {
            const parsed = await simpleParser(message.source);
            
            const from = parsed.from?.text || 'Unknown Sender';
            const subject = parsed.subject || '(No Subject)';
            const bodyHtml = parsed.html || `<div style="font-family:sans-serif; padding:10px;">${parsed.textAsHtml || parsed.text}</div>`;

            const exists = await EmailMessage.findOne({ senderEmailId: sender.email, subject, from });
            
            if (!exists) {
              await EmailMessage.create({
                senderEmailId: sender.email,
                folder: 'inbox',
                from,
                to: sender.email,
                subject,
                bodyHtml,
                isRead: false,
                leadStage: 'New Lead',
                date: parsed.date || new Date()
              });
              console.log(`[Inbox Sync] New incoming email saved for ${sender.email}: ${subject}`);
            }

            await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          }
        } finally {
          lock.release();
        }

        await client.logout();
      } catch (connErr) {
        // Gracefully catch timeout or network issues per sender without crashing
        console.warn(`Skipping inbox sync for ${sender.email} due to network timeout/auth check.`);
      }
    }
  } catch (err) {
    console.error('Mail Polling Loop Error:', err.message);
  }
};