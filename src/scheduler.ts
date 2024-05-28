// src/scheduler.ts
import prisma from "./prismaClient";
import schedule from "node-schedule";
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
async function sendEmail(
  email: string,
  message: string,
  messageID: number,
  schedule: Date
) {
  try {
    await axios.post(EMAIL_API_URL, { email, message });
    console.log(`Email sent to ${email}`);
    const nextYearSchedule = new Date(schedule);
    nextYearSchedule.setFullYear(new Date().getFullYear() + 1);

    await prisma.message.update({
      where: { id: messageID },
      data: { status: "not triggered", schedule: nextYearSchedule },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error sending email to ${email}: ${error.message}`);
    }
    await prisma.message.update({
      where: { id: messageID },
      data: { status: "failed" },
    });
  }
}

async function sendBirthdayMessage(message: any, user: any) {
  const birthdayMessage = `Hey, ${user.firstName} ${user.lastName} it’s your birthday`;
  await sendEmail(user.email, birthdayMessage, message.id, message.schedule);
}

export function scheduleBirthdayMessages(message: any, user: any) {
  const jobName = `${user.id}-birthday`;
  const scheduleDate = new Date(message.schedule);
  scheduleDate.setHours(9, 0, 0, 0); // Schedule for 9 AM

  // Cancel any existing job with the same name
  const existingJob = schedule.scheduledJobs[jobName];
  if (existingJob) {
    existingJob.cancel();
  }

  // Schedule the new job
  schedule.scheduleJob(jobName, scheduleDate, async () => {
    await sendBirthdayMessage(message, user);
  });

  console.log(`Scheduled job ${jobName} for ${scheduleDate}`);
}

export async function deleteOldSchedule(jobName: string) {
  const existingJob = schedule.scheduledJobs[jobName];
  if (existingJob) {
    existingJob.cancel();
    console.log(`Deleted old schedule job ${jobName}`);
  }
}

export async function scheduleDailyMessages() {
  console.log(new Date(new Date().setHours(23, 59, 59, 999)));
  schedule.scheduleJob("0 0 * * *", async () => {
    const messages = await prisma.message.findMany({
      where: {
        schedule: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: {
          not: "success",
        },
      },
    });
    console.log(messages);
    for (const message of messages) {
      const user = await prisma.user.findUnique({
        where: { id: message.userID },
      });
      if (user) {
        await scheduleBirthdayMessages(message, user);
      }
    }
  });
}

export async function scheduleHourlyRetry() {
  schedule.scheduleJob("0 * * * *", async () => {
    const messages = await prisma.message.findMany({
      where: {
        schedule: {
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: {
          not: "success",
        },
      },
    });
    console.log(messages);
    for (const message of messages) {
      const user = await prisma.user.findUnique({
        where: { id: message.userID },
      });
      if (user) {
        await sendBirthdayMessage(message, user);
      }
    }
  });
}
