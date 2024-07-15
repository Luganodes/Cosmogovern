import pino from "pino";
import pinoPretty from "pino-pretty";
import { hostname } from "os";

const LOG_LEVEL = Bun.env.LOG_LEVEL || "info";

const logger = (name: string) => {
  const prettyStream = pinoPretty({
    colorize: true,
    translateTime: "SYS:standard",
    ignore: "pid,hostname",
  });

  const logger = pino(
    {
      name,
      level: LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: true,
          ignore: "pid,hostname",
        },
      },
      base: {
        pid: process.pid,
        hostname: hostname(),
      },
      serializers: {
        req: (req: any) => ({
          method: req.method,
          url: req.url,
          headers: req.headers,
        }),
        res: (res: any) => ({
          statusCode: res.statusCode,
        }),
      },
    },
    prettyStream,
  );

  return logger;
};

export default logger;


export function capitalize(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}