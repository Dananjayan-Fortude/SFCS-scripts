import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { DatabaseService } from './database.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly dbservice: DatabaseService) {}
  @Get('/:displayId')
  async getData(@Param('displayId') displayId: string, @Res() res: Response) {
    try {
      await this.dbservice.getData(displayId, res);
    } catch (error) {
      console.error('Error in getData:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
