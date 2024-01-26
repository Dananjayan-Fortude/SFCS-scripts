import { Module } from '@nestjs/common';
import { CplUpdateController } from './cpl_update.controller';
import { CplUpdateService } from './cpl_update.service';

@Module({
  controllers: [CplUpdateController],
  providers: [CplUpdateService]
})
export class CplUpdateModule {}
