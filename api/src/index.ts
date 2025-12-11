import express from "express";
import cors from "cors";
import filesRouter from "./routes/files";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/files", filesRouter);

app.listen(PORT, () => {
  console.log(`Serveur API démarré sur http://localhost:${PORT}`);
});