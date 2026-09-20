package com.scorebook.service;

import com.scorebook.entity.User;
import com.scorebook.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.concurrent.ThreadLocalRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户业务逻辑。
 *
 * 安全要点：
 *  - 角色 role 由「管理员 openid 白名单」判定，绝不接受前端传入。
 *  - 资料修改接口只接收 avatar / nickname，role 不会被改动（防越权提权）。
 *  - 头像必须 ∈ 预置白名单；昵称 trim 后非空且 ≤ 32 字。
 */
@Service
public class UserService {

    private final UserRepository repo;

    /** 管理员 openid 白名单，逗号分隔；当前为空，后期在配置里补 */
    @Value("${app.admin-openids:}")
    private String adminOpenids;

    /** 预置头像白名单，须与前端 avatarList 保持一致 */
    @Value("${app.avatar-list:avatar_01,avatar_02,avatar_03,avatar_04}")
    private String avatarListStr;

    public UserService(UserRepository repo) {
        this.repo = repo;
    }

    /** 首次访问初始化用户：不存在才新建；已存在但昵称为空时兜底补一个可爱默认昵称（避免显示层 fallback「我/朋友」）。角色由后端白名单判定。 */
    public User initUser(String openid) {
        User u = repo.findByOpenid(openid).orElseGet(() -> {
            User nu = new User();
            nu.setOpenid(openid);
            // 默认生成可爱昵称：微信 wx.login 阶段不下发真实昵称（平台限制），
            // 这里直接给一个随机萌系昵称，用户可在「个人页」点输入框一键填入微信昵称或手动改。
            nu.setNickname(generateDefaultNickname());
            nu.setAvatar("avatar_01");
            nu.setRole(isAdmin(openid) ? "admin" : "user");
            nu.setCreatedAt(LocalDateTime.now());
            nu.setUpdatedAt(LocalDateTime.now());
            return repo.save(nu);
        });
        // 兜底：老用户（昵称空）补一个随机可爱昵称，登录即生效；不覆盖用户已设置的昵称
        if (u.getNickname() == null || u.getNickname().isBlank()) {
            u.setNickname(generateDefaultNickname());
            u.setUpdatedAt(LocalDateTime.now());
            u = repo.save(u);
        }
        return u;
    }

    public User getProfile(String openid) {
        return repo.findByOpenid(openid)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
    }

    public User updateProfile(String openid, String avatar, String nickname) {
        User u = getProfile(openid);
        if (avatar != null) {
            String a = avatar.trim();
            if (!Arrays.asList(avatarListStr.split(",")).contains(a)) {
                throw new IllegalArgumentException("头像不在允许列表内");
            }
            u.setAvatar(a);
        }
        if (nickname != null) {
            String n = nickname.trim();
            if (n.isEmpty() || n.length() > 32) {
                throw new IllegalArgumentException("昵称长度需在 1-32 之间");
            }
            u.setNickname(n);
        }
        u.setUpdatedAt(LocalDateTime.now());
        // 注意：role 字段此处绝不修改，防止普通用户伪造管理员
        return repo.save(u);
    }

    public List<User> listAll() {
        return repo.findAll();
    }

    public boolean isAdmin(String openid) {
        if (adminOpenids == null || adminOpenids.isBlank()) {
            return false;
        }
        return Arrays.stream(adminOpenids.split(","))
                .map(String::trim)
                .anyMatch(openid::equals);
    }

    /**
     * 批量查用户的公开资料（openid / nickname / avatar），用于空间列表、比赛记录里显示双方真实昵称与头像。
     * 只返回公开字段，不返 role 等敏感信息。未注册过的 openid 不会出现（前端用空间里存的名字兜底）。
     */
    public List<Map<String, String>> getMembers(List<String> openids) {
        if (openids == null || openids.isEmpty()) {
            return List.of();
        }
        final List<String> want = openids;
        return repo.findAll().stream()
                .filter(u -> want.contains(u.getOpenid()))
                .map(u -> {
                    Map<String, String> m = new HashMap<>();
                    m.put("openid", u.getOpenid());
                    m.put("nickname", u.getNickname() == null ? "我" : u.getNickname());
                    m.put("avatar", u.getAvatar() == null ? "avatar_01" : u.getAvatar());
                    return m;
                })
                .toList();
    }

    // ---- 默认昵称（萌系随机）----
    private static final String[] CUTE_PREFIX = {"快乐","软萌","元气","呆萌","甜甜","酷酷","懒懒","萌萌","迷你","超萌","奶萌","幸福","星光"};
    private static final String[] CUTE_SUFFIX = {"小熊猫","小兔","小老虎","小猫咪","小企鹅","小狐狸","小浣熊","小考拉","小海豚","星宝","奶糖","布丁","团子","云朵","泡芙"};

    /** 生成默认可爱昵称：前缀 + 萌物后缀（如「快乐小熊猫」），长度均 < 32。 */
    private String generateDefaultNickname() {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        String p = CUTE_PREFIX[rnd.nextInt(CUTE_PREFIX.length)];
        String s = CUTE_SUFFIX[rnd.nextInt(CUTE_SUFFIX.length)];
        return p + s;
    }
}
