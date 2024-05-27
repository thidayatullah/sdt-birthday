// src/scheduler.ts
import prisma from "./prismaClient";
import cron from "node-cron";
import moment from "moment-timezone";
import axios from "axios";

const EMAIL_API_URL = "https://email-service.digitalenvision.com.au/send-email";

type userModel = {
  id?: number;
  userName?: string;
  email: any;
  firstName: any;
  lastName: any;
  birthday?: Date;
  location?: string;
};

async function sendEmail(email: string, message: string) {
  try {
    await axios.post(EMAIL_API_URL, { email, message });
    console.log(`Email sent to ${email}`);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error sending email to ${email}: ${error.message}`);
    } else {
      console.error(
        `Error sending email to ${email}: An unknown error occured`
      );
    }

    return false;
  }
}

export async function sendBirthdayMessage(user: userModel) {
  const message = `Hey, ${user.firstName} ${user.lastName} it’s your birthday`;
  const success = await sendEmail(user.email, message);
  if (!success) {
    console.log(`Failed to send message to ${user.email}. It will be retried.`);
    // Implement retry or save logic here
  }
}

export async function scheduleBirthdayMessages() {
  const users = await prisma.user.findMany();

  users.forEach((user) => {
    const now = moment().tz(user.location);
    const birthday = moment(user.birthday).tz(user.location).year(now.year());

    if (birthday.isBefore(now)) {
      birthday.add(1, "year");
    }

    // const cronTime = `0 9 ${birthday.date()} ${birthday.month() + 1} *`;
    const cronTime = `* * * * *`;

    cron.schedule(
      cronTime,
      async () => {
        await sendBirthdayMessage(user);
      },
      {
        scheduled: true,
        timezone: user.location,
      }
    );

    console.log(
      `Scheduled birthday message for ${user.email} on ${birthday.format()}`
    );
  });
}
