export type AppErrorOptions = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  isOperational?: boolean;
};
