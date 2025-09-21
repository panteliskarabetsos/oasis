import nodemailer from 'nodemailer';

export async function POST(req) {
  const { name, email, message } = await req.json();

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "Unknown";

  //  IP
  let location = "Unknown";
  try {
    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'Node.js Contact Form',
      },
    });
    const geoData = await geoRes.json();

    if (!geoData || geoData.error) {
      console.warn("IP API returned error or empty response:", geoData);
    } else {
      const city = geoData.city || 'Unknown city';
      const country = geoData.country_name || 'Unknown country';
      location = `${city}, ${country}`;
    }
  } catch (err) {
    console.warn("Geolocation fetch failed", err);
  }


  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Main email
  const mailOptions = {
    from: `"Pantelis Karabetsos" <${process.env.EMAIL_USER}>`,
    replyTo: email,
    to: 'karapantelis21@gmail.com',
    subject: `New message from ${name}`,
    text: message,
    html: `
    <div style="font-family: 'Segoe UI', sans-serif; background: #f4f1ec; padding: 24px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 20px; box-shadow: 0 12px 30px rgba(0,0,0,0.05); border: 1px solid #e6e0d6;">
        <div style="text-align: center; padding: 32px 24px; background: linear-gradient(to right, #8b6f47, #b99b75); color: white; border-radius: 20px 20px 0 0;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 600;">New Contact Message</h1>
        </div>
        <div style="padding: 24px; color: #3f3f3f; font-size: 16px;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Received:</strong> ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Athens' })}</p>
          <p><strong>IP Address:</strong> ${ip}</p>
          <p><strong>Location:</strong> ${location}</p>
        </div>
        <div style="padding: 0 24px 24px;">
          <p><strong>Message:</strong></p>
          <div style="background: #f5f0ea; border-radius: 12px; padding: 16px; font-style: italic;">${message}</div>
        </div>
      </div>
    </div>
  `,
  
  };

  // Auto-reply email
  const autoReply = {
    from: `"Oasis" <noreply@pkarabetsos.com>`,
    replyTo: "contact@pkarabetsos.com",
    to: email,
    subject: `We've received your message, ${name}!`,
    html: `
    <div style="font-family: 'Segoe UI', sans-serif; background: #f4f1ec; padding: 32px 16px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05); border: 1px solid #e6e0d6;">
        
        <!-- Banner -->
        <div style="text-align: center; padding: 40px 24px; background: linear-gradient(to right, #8b6f47, #b99b75); color: #ffffff; border-radius: 20px 20px 0 0;">
          <img src="https://pnoe.vercel.com/favicon.ico" alt="Logo" width="48" height="48" style="border-radius: 12px; margin-bottom: 16px;" />
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Message Received</h1>
          <p style="margin-top: 8px; font-size: 16px; font-weight: 400;">
            Thank you for getting in touch. We’ll be with you shortly.
          </p>
        </div>
  
        <!-- Body -->
        <div style="padding: 32px 24px; font-size: 15px; color: #3f3f3f; line-height: 1.75;">
          <p>Hi <strong>${name}</strong>,</p>
          <p>Thanks for reaching out to Oasis. We’ve received your message and will get back to you soon.</p>
          <p>In the meantime, feel free to explore <a href="https://pnoe.vercel.com" target="_blank" style="color: #8b6f47; text-decoration: underline;">our experiences</a>.</p>
        </div>
  
        <!-- Footer -->
        <div style="padding: 24px; font-size: 14px; color: #888; text-align: center; border-top: 1px solid #eee;">
          <p style="margin-bottom: 6px;">— Oasis</p>
          <a href="https://pnoe.vercel.com" target="_blank" style="color: #8b6f47; font-weight: 500; text-decoration: none;">
            pnoe.vercel.com
          </a>
        </div>
      </div>
    </div>
  `,
  
  };

  try {
    await transporter.sendMail(mailOptions);
    await transporter.sendMail(autoReply);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Email sending error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
