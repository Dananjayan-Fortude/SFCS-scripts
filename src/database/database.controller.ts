import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { DatabaseService } from './database.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly dbservice: DatabaseService) {}

  @Get('ExcelGen/:displayId')
  async getData(@Param('displayId') displayId: string, @Res() res: Response) {
    try {
      await this.dbservice.getData(displayId, res);
    } catch (error) {
      console.error('Error in getData:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // @Get('errorpayload/:displayId')
  // async getErrorPayload(
  //   @Param('displayId') displayId: string,
  //   @Res() res: Response,
  // ) {
  //   try {
  //     const data = await this.dbservice.getErrorPayload(displayId, res);
  //     this.pass(data);
  //   } catch (error) {
  //     console.error('Error in getData:', error);
  //     res.status(500).json({ error: 'Internal Server Error' });
  //   }
  // }
  @Get('errorpayload/:displayId')
  async getErrorPayload(@Param('displayId') displayId: string) {
    try {
      const data = await this.dbservice.getErrorPayload(displayId);
      for (let i = 0; i < data.length; i++) {
        console.log(data[i]);
        //return data[i];
      }
      return data;
    } catch (error) {
      console.error('Error in getData:', error);
      return { error };
    }
  }
}
