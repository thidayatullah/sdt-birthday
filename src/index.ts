import prisma from "./prismaClient";
import express, { Request, Response } from "express";
import createError from "http-errors";
import { scheduleDailyMessages } from "./scheduler";

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
    const thisYearBirthday = new Date(
      today.getFullYear(),
      birthdayDate.getMonth(),
      birthdayDate.getDate()
    );
    const nextBirthday = new Date(
      today.getFullYear() + 1,
      birthdayDate.getMonth(),
      birthdayDate.getDate()
    );
    let isBirthdayPassed = thisYearBirthday <= today;
    console.log(thisYearBirthday);
    console.log(today);
    console.log(thisYearBirthday > today);
    console.log(thisYearBirthday < today);

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

  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...req.body,
        birthday: birthday ? birthday : undefined,
      },
    });

    const birthdayDate = new Date(birthday);
    const today = new Date();
    const thisYearBirthday = new Date(
      today.getFullYear(),
      birthdayDate.getMonth(),
      birthdayDate.getDate()
    );
    const nextBirthday = new Date(
      today.getFullYear() + 1,
      birthdayDate.getMonth(),
      birthdayDate.getDate()
    );
    let isBirthdayPassed = thisYearBirthday <= today;

    const message = await prisma.message.findFirst({
      where: { userID: user.id },
    });
    if (
      message &&
      new Date(birthday).toISOString() !== message.schedule.toISOString()
    ) {
      await prisma.message.update({
        where: { id: message.id },
        data: { schedule: isBirthdayPassed ? nextBirthday : thisYearBirthday },
      });
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

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
