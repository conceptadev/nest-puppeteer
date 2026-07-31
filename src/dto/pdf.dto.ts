import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

import type { PaperFormat, PdfMargin, PdfOptions } from "../interfaces/pdf-options.interface.js";
import { CommonBrowserDto } from "./common-browser.dto.js";

const PAPER_FORMATS = [
  "letter",
  "legal",
  "tabloid",
  "ledger",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
];

export class PdfDto extends CommonBrowserDto implements PdfOptions {
  @ApiPropertyOptional({ description: "Display header and footer" })
  @IsOptional()
  @IsBoolean()
  displayHeaderFooter?: boolean;

  @ApiPropertyOptional({ description: "HTML template for the header" })
  @IsOptional()
  @IsString()
  headerTemplate?: string;

  @ApiPropertyOptional({ description: "HTML template for the footer" })
  @IsOptional()
  @IsString()
  footerTemplate?: string;

  @ApiPropertyOptional({ description: "Print background graphics", default: false })
  @IsOptional()
  @IsBoolean()
  printBackground?: boolean;

  @ApiPropertyOptional({ description: "Page margins { top, bottom, left, right }", type: Object })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? JSON.parse(value) : value))
  @IsObject()
  margin?: PdfMargin;

  @ApiPropertyOptional({ description: "Page ranges to print, e.g. '1-5, 8'" })
  @IsOptional()
  @IsString()
  pageRanges?: string;

  @ApiPropertyOptional({
    description: "Give any CSS @page size priority over declared width/height",
  })
  @IsOptional()
  @IsBoolean()
  preferCSSPageSize?: boolean;

  @ApiPropertyOptional({
    description: "Scale of the webpage rendering (0.1-2)",
    minimum: 0.1,
    maximum: 2,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(2)
  scale?: number;

  @ApiPropertyOptional({
    enum: PAPER_FORMATS,
    description: "Paper format (case-insensitive)",
    default: "letter",
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.toLowerCase() : value))
  @IsIn(PAPER_FORMATS)
  format?: PaperFormat;

  @ApiPropertyOptional({ description: "Landscape orientation" })
  @IsOptional()
  @IsBoolean()
  landscape?: boolean;

  @ApiPropertyOptional({ description: "Paper width (CSS units or number in px)" })
  @IsOptional()
  width?: string | number;

  @ApiPropertyOptional({ description: "Paper height (CSS units or number in px)" })
  @IsOptional()
  height?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  omitBackground?: boolean;

  @ApiPropertyOptional({ description: "Generate tagged (accessible) PDF" })
  @IsOptional()
  @IsBoolean()
  tagged?: boolean;

  @ApiPropertyOptional({ description: "Timeout in ms" })
  @IsOptional()
  @IsNumber()
  timeout?: number;
}

/**
 * DTO for file upload PDF generation.
 * Omits url/html since the content comes from the uploaded file.
 */
export class PdfFileDto extends OmitType(PdfDto, ["url", "html"] as const) {
  @ApiProperty({ type: "string", format: "binary", description: "HTML file to convert to PDF" })
  file!: any;
}
