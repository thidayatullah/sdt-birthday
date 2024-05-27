import { PrismaClient } from "@prisma/client";
import express, { Request, Response } from "express";
import createError from "http-errors";

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

app.post("/user", async (req: Request, res: Response) => {
  const { birthday } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        ...req.body,
        birthday: new Date(birthday),
      },
    });
    res.status(201).send(user);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).send({ error: error.message });
    } else {
      res.status(400).send({ error: "An unknown error occured" });
    }
  }
});

app.get("/:username", async (req: Request, res: Response) => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({
    where: { userName: String(username) },
  });
  res.json(user);
});

app.delete("/user/:username", async (req, res) => {
  const { username } = req.params;
  try {
    await prisma.user.delete({ where: { userName: username } });
    res.status(204).send();
  } catch (error) {
    res.status(404).send({ error: "User not found" });
  }
});

app.put("/user/:id", async (req, res) => {
  const { id } = req.params;
  const { birthday } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...req.body,
        birthday: new Date(birthday),
      },
    });
    res.status(200).send(user);
  } catch (error) {
    res.status(404).send({ error: "User not found" });
  }
});

// handle 404 error
app.use((req: Request, res: Response, next: Function) => {
  next(createError(404));
});

app.listen(3000, () =>
  console.log(`⚡️[server]: Server is running at https://localhost:3000`)
);
