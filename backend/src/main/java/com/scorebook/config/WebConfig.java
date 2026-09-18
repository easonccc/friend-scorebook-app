package com.scorebook.config;

import com.scorebook.interceptor.LoginInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 层统一配置（Step 1 配置层）：CORS + 拦截器注册。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final LoginInterceptor loginInterceptor;

    public WebConfig(LoginInterceptor loginInterceptor) {
        this.loginInterceptor = loginInterceptor;
    }

    /**
     * 跨域配置。
     * 说明：微信小程序用 wx.request 调接口，本身不受浏览器同源策略限制，CORS 对真机
     * 小程序不是必选项；但本地用浏览器/curl 调试、或以后接 Web 端时会用到，这里先放开。
     * allowedOriginPatterns("*") + allowCredentials(true) 是 Spring 推荐的「允许任意源带凭证」写法。
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }

    /**
     * 注册登录拦截器。
     * Step 1 拦截器目前是放行状态，这里先把框架搭好；后续接入 token 校验后，
     * 可在此用 excludePathPatterns 把 /health、登录/换取 openid 等白名单接口排除掉。
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loginInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/health");
    }
}
