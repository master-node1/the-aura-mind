import { IsString, IsOptional, IsNumber, Min, Max, IsIn } from 'class-validator';

export class CreateMemoryDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsIn(['short', 'long', 'semantic'])
  memoryType?: string = 'long';

  @IsOptional()
  @IsIn(['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral', 'love', 'anxiety'])
  emotionTag?: string = 'neutral';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importanceScore?: number = 0.5;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
