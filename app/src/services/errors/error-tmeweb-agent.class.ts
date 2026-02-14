import { ErrorBase } from "./error-base.class";


export class ErrorTimewebAgent extends ErrorBase {
    private textError: string;
    private res: Response;
    private errParse: any;
    private messageError: string = "";
    constructor(message: string, text: string, res: Response) {
        super(message, "ErrorTimewebAgent");
        this.textError = text;
        this.initError();

    }
    private initError() {

        try {
            this.errParse = JSON.parse(this.textError);

        } catch {
            this.messageError = `Timeweb HTTP error ${this.res?.status}: ${this.res?.statusText} – raw: ${this.textError}`

        }
        const statusCode = this.errParse?.status_code ?? this.res?.status;
        const errorCode = this.errParse?.error_code ?? 'unknown_error';
        const message = Array.isArray(this.errParse?.message)
            ? this.errParse?.message.join('; ')
            : this.errParse?.message ?? 'no message';
        const responseId = this.errParse?.response_id ?? 'no_response_id';
        this.messageError = `Timeweb agent error ${statusCode} (${errorCode}), response_id=${responseId}: ${message}`;
        this.saveLog(this.messageError);
    }

}
