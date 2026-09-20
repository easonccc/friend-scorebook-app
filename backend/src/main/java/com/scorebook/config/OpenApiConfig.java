package com.scorebook.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger / OpenAPI 文档元信息配置。
 * 启动后访问 /swagger-ui.html 即可看到自动生成的在线接口文档。
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI scorebookOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("朋友比分账本 API")
                        .description("Java 后端接口文档（迁移自微信云开发）。当前仅 /health 已落地，其余接口随 Step 3+ 逐步补充。")
                        .version("v0.0.1"));
    }
}
