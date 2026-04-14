'use strict';

/**
 * HTML email templates.
 * These are passed to the email BullMQ queue as `html` payloads.
 * In production, replace with a proper template engine (MJML, Handlebars, etc.)
 */

const base = (content, previewText = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>LinkedIn Clone</title>
  <style>
    body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background:#f3f2ef; color:#000; }
    .container { max-width:600px; margin:32px auto; background:#fff;
                 border-radius:8px; overflow:hidden; }
    .header { background:#0a66c2; padding:24px 32px; }
    .header h1 { color:#fff; margin:0; font-size:22px; }
    .body { padding:32px; }
    .footer { background:#f3f2ef; padding:16px 32px; font-size:12px; color:#666; text-align:center; }
    .btn { display:inline-block; padding:12px 24px; background:#0a66c2; color:#fff;
           border-radius:24px; text-decoration:none; font-weight:600; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>
  <div class="container">
    <div class="header"><h1>LinkedIn Clone</h1></div>
    <div class="body">${content}</div>
    <div class="footer">© ${new Date().getFullYear()} LinkedIn Clone · You are receiving this because you signed up.</div>
  </div>
</body>
</html>`;

/**
 * Welcome email sent after registration.
 */
const welcomeEmail = (user) => ({
  subject: `Welcome to LinkedIn Clone, ${user.name}!`,
  html: base(
    `<h2>Hi ${user.name},</h2>
     <p>We're thrilled to have you! Your profile is ready. Start connecting with professionals and sharing your expertise.</p>
     <p style="margin-top:24px;">
       <a href="${process.env.CLIENT_URL}/profile" class="btn">Complete Your Profile</a>
     </p>`,
    `Welcome aboard, ${user.name}!`
  ),
});

/**
 * Connection accepted notification email.
 */
const connectionAcceptedEmail = (recipient, actor) => ({
  subject: `${actor.name} accepted your connection request`,
  html: base(
    `<h2>Great news, ${recipient.name}!</h2>
     <p><strong>${actor.name}</strong> accepted your connection request. You are now connected.</p>
     <p>${actor.headline || ''}</p>
     <p style="margin-top:24px;">
       <a href="${process.env.CLIENT_URL}/profile/${actor._id}" class="btn">View Profile</a>
     </p>`,
    `${actor.name} is now your connection!`
  ),
});

/**
 * Post like notification email.
 */
const postLikedEmail = (recipient, actor, postId) => ({
  subject: `${actor.name} liked your post`,
  html: base(
    `<h2>Hi ${recipient.name},</h2>
     <p><strong>${actor.name}</strong> liked your post. Check who else is engaging with your content.</p>
     <p style="margin-top:24px;">
       <a href="${process.env.CLIENT_URL}/posts/${postId}" class="btn">View Post</a>
     </p>`,
    `${actor.name} liked your post`
  ),
});

module.exports = { welcomeEmail, connectionAcceptedEmail, postLikedEmail };
