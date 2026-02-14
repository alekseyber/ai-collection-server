import { ErrorBase } from "./error-base.class";


export class ErrorApp extends ErrorBase {
    constructor(message: string) {
        super(message, "ErrorApp");
        this.saveLog(message)
    }
}