import { Controller, Get, Param } from '@nestjs/common';
import { CplUpdateService } from './cpl_update.service';
import axios from 'axios';
import * as https from 'https';

@Controller('cpl-update')
export class CplUpdateController {
  constructor(private readonly cplUpdateService: CplUpdateService) {}

  @Get('CPL/:filename')
  async getCplUpdate(@Param('filename') filename: string) {
    const filePath = `${filename}.xlsx`;
    const excelData = await this.cplUpdateService.getCplUpdate(filePath);
    return excelData;
  }

  async postReq() {
    const url =
      'https://sfcs-gateway-cloud.live.brandixlk.org/sfcs-proxy-service/connectors/allocation/getAllocation';
    const dataToSend = {
      warehouse: 'B03',
      rmItemNumber: 'FWFT00054 00089',
      style: 'HWU3004S40',
    };

    // Allow self-signed certificates
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    try {
      const response = await axios.post(url, dataToSend, { httpsAgent: agent });
      console.log('Response from the server:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error making POST request:', error.message);
      throw error;
    }
  }
}
