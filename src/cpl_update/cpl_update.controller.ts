import { Controller, Get, Param } from '@nestjs/common';
import { CplUpdateService } from './cpl_update.service';

@Controller('cpl-update')
export class CplUpdateController {
  constructor(private readonly cplUpdateService: CplUpdateService) {}

  @Get('CPL/:filename')
  async getCplUpdate(@Param('filename') filename: string) {
    const filePath = `${filename}.xlsx`;
    const excelData = await this.cplUpdateService.getCplUpdate(filePath);
    return excelData;
  }
}
