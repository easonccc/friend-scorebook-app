package com.scorebook.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 微信小程序基础配置（Step 1 配置层）。
 *
 * 设计取舍：
 *  - appid 是「会打包进前端」的公开标识，可以写进 application.yml 并提交。
 *  - secret 属于密钥，绝不能硬编码进仓库。这里用 ${WECHAT_SECRET:changeme} 从
 *    环境变量读取，本地起服务前 `export WECHAT_SECRET=xxx` 即可（见 README/提交说明）。
 */
@Component
@ConfigurationProperties(prefix = "wechat")
public class WechatProperties {

    private String appid = "";
    private String secret = "";

    public String getAppid() {
        return appid;
    }

    public void setAppid(String appid) {
        this.appid = appid;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }
}
