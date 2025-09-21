export const generateCancellationEmail = (booking) => {
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
      subject: `Booking Cancelled – ${experience.name}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; background-color: #fff8f5; color: #5a4a3f;">
          <div style="max-width: 600px; margin: auto; background: white; border: 1px solid #e5ded2; border-radius: 16px; padding: 32px;">
            <h2 style="color: #8b6f47;">Your booking has been cancelled</h2>
            <p style="font-size: 16px;">
              We’re sorry to see you go, but your reservation for <strong>${experience.name}</strong> has been successfully cancelled.
            </p>
  
            <table style="margin-top: 16px; font-size: 14px;">
              <tr><td><strong>Date:</strong></td><td>${formattedDate}</td></tr>
              <tr><td><strong>Time:</strong></td><td>${formattedTime}</td></tr>
              <tr><td><strong>Location:</strong></td><td>${experience.location}</td></tr>
              <tr><td><strong>Guests:</strong></td><td>${numberOfPeople}</td></tr>
              ${notes ? `<tr><td><strong>Notes:</strong></td><td>${notes}</td></tr>` : ''}
            </table>
  
            <p style="margin-top: 24px; font-size: 14px;">
              If you have questions or wish to rebook, please reply to this email.
            </p>
  
            <p style="margin-top: 32px;">– The Oasis Team</p>
          </div>
        </div>
      `,
    };
  };
  