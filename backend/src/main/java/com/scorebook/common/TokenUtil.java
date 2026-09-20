package com.scorebook.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

/**
 * 轻量级无状态 token 工具（HS256 思路，不引第三方 JWT 库，保持依赖简单）。
 *
 * token 结构：base64url(header).base64url(payload).base64url(HMAC-SHA256)
 * payload 含 openid 与过期时间 exp。
 * 后端在拦截器里 verify 出 openid 即可，不依赖 Redis / 数据库会话。
 *
 * 为何不用 Redis：当前是中小型小程序，无状态 token 足够；后期若要「强制下线」再引入 Redis 做吊销。
 */
@Component
public class TokenUtil {

    @Value("${app.token.secret}")
    private String secret;

    @Value("${app.token.ttl-seconds:86400}")
    private long ttlSeconds;

    private final ObjectMapper mapper = new ObjectMapper();

    /** 为某个 openid 签发 token */
    public String generate(String openid) {
        long exp = Instant.now().getEpochSecond() + ttlSeconds;
        String header = b64url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = b64url("{\"openid\":\"" + openid + "\",\"exp\":" + exp + "}");
        String signInput = header + "." + payload;
        // 注意：hmac() 内部已经做了 base64url 编码，这里直接返回，不能再套一层 b64url（否则变成双重编码）
        return signInput + "." + hmac(signInput);
    }

    /** 校验 token，成功返回 openid，失败抛 IllegalArgumentException */
    public String verify(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("token 为空");
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("token 格式错误");
        }
        String signInput = parts[0] + "." + parts[1];
        // 与 generate 保持一致：hmac() 返回的就是 base64url 签名，不再二次编码
        String expected = hmac(signInput);
        // 用 MessageDigest.isEqual 做常量时间比较，避免计时攻击
        if (!MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("token 签名无效");
        }
        try {
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            Map<?, ?> payload = mapper.readValue(payloadJson, Map.class);
            Object expObj = payload.get("exp");
            if (expObj != null && Instant.now().getEpochSecond() > Long.parseLong(expObj.toString())) {
                throw new IllegalArgumentException("token 已过期");
            }
            String openid = (String) payload.get("openid");
            if (openid == null || openid.isBlank()) {
                throw new IllegalArgumentException("token 无 openid");
            }
            return openid;
        } catch (JacksonException e) {
            throw new IllegalArgumentException("token 解析失败", e);
        }
    }

    private String b64url(String s) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    private String hmac(String data) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            // 只在这里做一次 base64url 编码
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception e) {
            throw new RuntimeException("HMAC 计算失败", e);
        }
    }
}
