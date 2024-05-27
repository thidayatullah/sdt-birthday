import prisma from "./prismaClient";
import express, { Request, Response } from "express";
import createError from "http-errors";
import { scheduleDailyMessages } from "./scheduler";

const app = express();

app.use(express.json());

app.post("/user", async (req: Request, res: Response) => {
  const { firstName, lastName, email, birthday, timeZone } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        birthday: new Date(birthday),
        timeZone,
      },
    });

    const birthdayDate = new Date(birthday);
    const today = new Date();
    await prisma.message.create({
      data: {
        userID: user.id,
        messageType: "birthday",
        schedule: new Date(
          today.getFullYear(),
          birthdayDate.getMonth(),
          birthdayDate.getDate()
        ),
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
  const today = new Date();
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...req.body,
        birthday: birthday
          ? new Date(
              today.getFullYear(),
              birthdayDate.getMonth(),
              birthdayDate.getDate()
            )
          : undefined,
      },
    });

    const message = await prisma.message.findFirst({
      where: { userID: user.id },
    });
    if (
      message &&
      new Date(birthday).toISOString() !== message.schedule.toISOString()
    ) {
      await prisma.message.update({
        where: { id: message.id },
        data: { schedule: new Date(birthday) },
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
