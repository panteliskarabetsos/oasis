import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    // 1. Safety check for your specific environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        "CRITICAL ERROR: EMAIL_USER or EMAIL_PASS is not set in environment variables.",
      );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      company,
      date,
      guests,
      location,
      concept,
      notes,
    } = body;

    // 2. Configure transporter using your exact variables
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: process.env.EMAIL_SECURE === "true" || true, // 465 uses true
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 3. Create email content
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Oasis" <${process.env.EMAIL_USER}>`,
      to: "info@youroasis.gr", // The inbox where you want to receive these requests
      replyTo: email, // Lets you hit "Reply" and email the client directly
      subject: `New Private Event Inquiry from ${name}`,
      html: `
        <h2 style="color: #c5a059; font-family: serif;">New Bespoke Inquiry</h2>
        <hr style="border-top: 1px solid #eee;" />
        <p><strong>Host Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Company/Group:</strong> ${company || "Not provided"}</p>
        <br/>
        <p><strong>Preferred Date:</strong> ${date}</p>
        <p><strong>Guest Count:</strong> ${guests}</p>
        <p><strong>Location/Villa:</strong> ${location || "Not provided"}</p>
        <p><strong>Experience Concept:</strong> ${concept}</p>
        <br/>
        <h3>Vision & Notes:</h3>
        <p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #c5a059;">
          ${notes || "No additional notes provided."}
        </p>
      `,
    };

    // 4. Send the email
    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: "Inquiry sent successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error sending inquiry email:", error);
    return NextResponse.json(
      { error: "Failed to send inquiry" },
      { status: 500 },
    );
  }
}
