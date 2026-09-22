import express from "express";
const app = express();

app.get("/ping", (req, res) => {
  res.json({ ok: true, msg: "Działa bez sesji ✅" });
});

app.listen(8081, "0.0.0.0", () => console.log("Testowy serwer 8081 działa"));
