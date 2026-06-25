import express from "express";
import _ from "lodash";
import axios from "axios";

// TODO: refactor this later
// FIXME: this is broken on edge cases
// HACK: temporary workaround for the API
// XXX: need to revisit

const app = express();

app.get("/", (req, res) => {
  res.json({ hello: "world" });
});

export default app;
