import prisma from "./prismaClient";
import express, { Request, Response } from "express";
import createError from "http-errors";
import {
  scheduleDailyMessages,
  scheduleHourlyRetry,
  scheduleBirthdayMessages,
  deleteOldSchedule,
} from "./scheduler";

const app = express();

app.use(express.json());

app.post("/user", async (req: Request, res: Response) => {
  const { birthday } = req.body;
  const birthdayDate = new Date(birthday);
  try {
    const user = await prisma.user.create({
      data: {
        ...req.body,
        birthday: birthdayDate,
      },
    });

    const today = new Date();

    const thisYearBirthday = new Date(birthday);
    thisYearBirthday.setFullYear(today.getFullYear());

    const nextBirthday = new Date(birthday);
    nextBirthday.setFullYear(today.getFullYear() + 1);

    const isBirthdayPassed = thisYearBirthday <= today;

    await prisma.message.create({
      data: {
        userID: user.id,
        messageType: "birthday",
        schedule: isBirthdayPassed ? nextBirthday : thisYearBirthday,
        status: "not triggered",
      },
    });

    res.status(201).send(user);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).send({ error: error.message });
    } else {
      res.status(400).send({ error: "An unknown error occurred" });
    }
  }
});

app.put("/user/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { birthday } = req.body;
  const birthdayDate = new Date(birthday);

  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...req.body,
        birthday: birthday ? birthdayDate : undefined,
      },
    });

    const today = new Date();

    const thisYearBirthday = new Date(birthday);
    thisYearBirthday.setFullYear(today.getFullYear());

    const nextBirthday = new Date(birthday);
    nextBirthday.setFullYear(today.getFullYear() + 1);

    const isBirthdayPassed = thisYearBirthday <= today;

    const message = await prisma.message.findFirst({
      where: { userID: user.id },
    });
    if (
      message &&
      new Date(birthday).toISOString() !== message.schedule.toISOString()
    ) {
      await deleteOldSchedule(`${user.id}-birthday`);

      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: { schedule: isBirthdayPassed ? nextBirthday : thisYearBirthday },
      });

      scheduleBirthdayMessages(updatedMessage, user);
    }

    res.status(200).send(user);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(404).send({ error: "User not found" });
    } else {
      res.status(400).send({ error: "An unknown error occurred" });
    }
  }
});

app.delete("/user/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    console.log("user ni bos: ", user);
    if (user) {
      await deleteOldSchedule(`${user.id}-birthday`);
    }
    await prisma.message.deleteMany({ where: { userID: parseInt(id) } });
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.status(204).send();
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(404).send({ error: "User not found" });
    } else {
      res.status(400).send({ error: "An unknown error occurred" });
    }
  }
});

// handle 404 error
app.use((req: Request, res: Response, next: Function) => {
  next(createError(404));
});

scheduleDailyMessages();
scheduleHourlyRetry();

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
