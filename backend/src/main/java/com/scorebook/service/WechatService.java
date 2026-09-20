package com.scorebook.service;

import com.scorebook.config.WechatProperties;
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

    private final WechatProperties props;
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper mapper = new ObjectMapper();

    public WechatService(WechatProperties props) {
        this.props = props;
    }

    public String code2Session(String code) {
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
}
