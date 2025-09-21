export const generateBookingConfirmationEmail = (booking) => {
  const { user, numberOfPeople, notes, scheduleSlot } = booking;
  const { date, experience } = scheduleSlot;

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(date).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    subject: `Booking Confirmation – ${experience.name}`,
    html: `
      <div style="font-family: 'Helvetica Neue', sans-serif; padding: 24px; background-color: #fdfaf5; color: #5a4a3f;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 5px 20px rgba(0,0,0,0.06); padding: 32px; border: 1px solid #e8e2d9;">
          <h2 style="margin-top: 0; font-size: 24px; color: #8b6f47;">Thank you for your booking${user.name ? `, ${user.name}` : ''}!</h2>
          <p style="font-size: 16px; margin-bottom: 24px;">
            We're excited to host you for <strong>${experience.name}</strong>. Here's a quick overview of your reservation:
          </p>

          <table style="width: 100%; font-size: 15px; color: #4a4a4a;">
            <tr>
              <td style="padding: 8px 0;"><strong>Date:</strong></td>
              <td style="padding: 8px 0;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Time:</strong></td>
              <td style="padding: 8px 0;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Location:</strong></td>
              <td style="padding: 8px 0;">${experience.location}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Guests:</strong></td>
              <td style="padding: 8px 0;">${numberOfPeople}</td>
            </tr>
            ${
              notes
                ? `<tr><td style="padding: 8px 0;"><strong>Notes:</strong></td><td style="padding: 8px 0;">${notes}</td></tr>`
                : ''
            }
          </table>

          <p style="margin-top: 32px; font-size: 14px; color: #777;">
            If you have any questions or need to make changes, simply reply to this email and we’ll be happy to assist you.
          </p>

          <p style="margin-top: 40px; font-size: 16px;">
            See you soon,<br/>
            <span style="font-weight: bold; color: #8b6f47;">The Oasis Team</span>
          </p>
        </div>
      </div>
    `,
  };
};
