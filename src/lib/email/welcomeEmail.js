import nodemailer from 'nodemailer';

export async function sendWelcomeEmail({ email, name }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

await transporter.sendMail({
    from: `"Oasis" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to Oasis!',
    html: `
      <div style="background-color:#f4f1ec; padding:40px 20px; font-family:'Georgia', serif; color:#5a4a3f; text-align:center;">
        <div style="max-width:600px; margin:0 auto; background:white; border:1px solid #e0dcd4; border-radius:12px; padding:40px;">
          <h1 style="font-size:28px; color:#8b6f47; margin-bottom:20px;">Welcome, ${name || 'There'} 🌿</h1>
          
          <p style="font-size:18px; line-height:1.6; margin-bottom:30px;">
            Thank you for becoming part of our journey.<br/>
            Together, we honor tradition, nature and authentic experiences.
          </p>
          
          <a href="https://youroasis.vercel.app/experiences" style="display:inline-block; padding:12px 24px; background-color:#8b6f47; color:white; text-decoration:none; border-radius:30px; font-size:16px; margin-bottom:30px;">
            Explore Experiences
          </a>
          
          <p style="font-size:16px; line-height:1.5; margin-top:30px;">
            If you ever need assistance or personalized suggestions,<br/>
            we’re just a message away.
          </p>
  
          <p style="margin-top:40px; font-style:italic; color:#7a6a5f;">
            — Oasis Team
          </p>
        </div>
  
        <p style="margin-top:20px; font-size:12px; color:#999;">
          You are receiving this email because you signed up on our platform.
        </p>
      </div>
    `,
  });
}