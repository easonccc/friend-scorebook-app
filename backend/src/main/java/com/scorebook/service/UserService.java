package com.scorebook.service;

import com.scorebook.entity.User;
import com.scorebook.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

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

    /** 首次访问初始化用户：不存在才新建，已存在直接返回。角色由后端白名单判定。 */
    public User initUser(String openid) {
        return repo.findByOpenid(openid).orElseGet(() -> {
            User u = new User();
            u.setOpenid(openid);
            u.setNickname("微信用户");
            u.setAvatar("avatar_01");
            u.setRole(isAdmin(openid) ? "admin" : "user");
            u.setCreatedAt(LocalDateTime.now());
            u.setUpdatedAt(LocalDateTime.now());
            return repo.save(u);
        });
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
}
