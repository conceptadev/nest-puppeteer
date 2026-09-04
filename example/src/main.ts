import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      skipUndefinedProperties: false,
      transformOptions: { exposeDefaultValues: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Browser Rendering API")
    .setDescription("Puppeteer-based browser rendering service")
    .setVersion("1.0")
    .build();

  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  await app.listen(3000);
  console.log("Server running on http://localhost:3000");
  console.log("Swagger docs at http://localhost:3000/docs");
}

bootstrap();
