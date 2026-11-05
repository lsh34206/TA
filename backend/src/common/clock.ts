import { Injectable } from '@nestjs/common';

/** 현재 시각 공급자. 시간에 의존하는 규칙을 테스트에서 고정할 수 있게 분리했다. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
