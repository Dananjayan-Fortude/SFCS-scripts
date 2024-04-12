import { Controller, Get, Param, Post } from '@nestjs/common';
import { FromlotService } from './fromlot.service';

@Controller('fromlot')
export class FromlotController {
  constructor(private readonly fromLotService: FromlotService) {}

  @Get('error1/:displayId')
  async postError1(@Param('displayId') displayId: string) {
    const results = await this.fromLotService.postError1(displayId);
    return { results };
  }
}
