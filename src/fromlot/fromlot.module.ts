import { Module } from '@nestjs/common';
import { FromlotController } from './fromlot.controller';
import { FromlotService } from './fromlot.service';

@Module({
  controllers: [FromlotController],
  providers: [FromlotService]
})
export class FromlotModule {}
