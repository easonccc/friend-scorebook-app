package com.scorebook.service;

import com.scorebook.config.WechatProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;

/**
 * 微信登录服务：用小程序 wx.login() 的临时 code 换 openid。
 *
 * 为什么放后端：这是「替代云开发 getWXContext().OPENID」的关键一步。
 * 前端只传 code，secret 只在后端配置里，前端既看不到 secret 也无法伪造 openid。
 */
@Service
public class WechatService {

    private static final Logger log = LoggerFactory.getLogger(WechatService.class);
    // 开发兜底 openid：未配置真实 AppSecret 时，登录直接映射到这个固定身份，
    // 方便开发者工具跑通整条登录+数据链路。生产环境注入真实 WECHAT_SECRET 后不会被使用。
    private static final String DEV_OPENID = "dev_openid_001";

    private final WechatProperties props;
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper mapper = new ObjectMapper();

    public WechatService(WechatProperties props) {
        this.props = props;
    }

    public String code2Session(String code) {
        // 开发兜底：secret 仍是占位符（未注入真实 WECHAT_SECRET）时，不真正调用微信，
        // 直接返回固定 dev openid，让本地开发者工具无需真实密钥即可联调。
        // 一旦注入真实密钥，此分支自动失效，走下方真实 code2session。
        if (isDevPlaceholder()) {
            log.warn("WechatService 处于开发兜底模式：secret 为占位符，code2Session 直接返回 {}，未真正调用微信", DEV_OPENID);
            return DEV_OPENID;
        }
        String url = "https://api.weixin.qq.com/sns/jscode2session"
                + "?appid=" + props.getAppid()
                + "&secret=" + props.getSecret()
                + "&js_code=" + code
                + "&grant_type=authorization_code";
        String body = restClient.get().uri(url).retrieve().body(String.class);
        try {
            Map<?, ?> map = mapper.readValue(body, Map.class);
            Object errcode = map.get("errcode");
            if (errcode != null && !"0".equals(errcode.toString())) {
                throw new RuntimeException("errcode=" + errcode + ", errmsg=" + map.get("errmsg"));
            }
            String openid = (String) map.get("openid");
            if (openid == null || openid.isBlank()) {
                throw new RuntimeException("微信响应中无 openid");
            }
            return openid;
        } catch (JacksonException e) {
            throw new RuntimeException("解析微信响应失败: " + body, e);
        }
    }

    // secret 是否为占位符（未配置真实 AppSecret）：空串或 changeme 都算
    private boolean isDevPlaceholder() {
        String s = props.getSecret();
        return s == null || s.isBlank() || "changeme".equals(s);
    }
}
