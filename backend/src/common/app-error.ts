import { HttpException } from '@nestjs/common';

/**
 * 도메인 오류. 프론트엔드가 `code`로 분기할 수 있도록 응답 본문에 함께 내려준다.
 */
export class AppError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, code, message, ...extra }, status);
  }
}
