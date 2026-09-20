package com.scorebook.service;

import com.scorebook.entity.UserSettings;
import com.scorebook.repository.UserSettingsRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 用户设置业务逻辑（对应原 user_settings 集合）。
 * 一人一条，openid 当主键；不存在时按默认值自动建一条，保证「取设置」永远有结果。
 */
@Service
public class UserSettingsService {

    private final UserSettingsRepository repo;

    public UserSettingsService(UserSettingsRepository repo) {
        this.repo = repo;
    }

    /** 取我的设置；不存在则建默认条目（默认比赛类型=台球，无自定义类型）。 */
    public UserSettings get(String openid) {
        return repo.findByOpenid(openid).orElseGet(() -> {
            UserSettings s = new UserSettings();
            s.setOpenid(openid);
            s.setDefaultType("台球");
            s.setDefaultSpaceId("");
            s.setCustomTypes(new ArrayList<>());
            s.setUpdatedAt(LocalDateTime.now());
            return repo.save(s);
        });
    }

    /** 更新设置（只更新传入的字段，未传的保持不变）。 */
    public UserSettings update(String openid, String defaultType, String defaultSpaceId,
                               List<String> customTypes) {
        UserSettings s = get(openid);
        if (defaultType != null) {
            s.setDefaultType(defaultType.trim());
        }
        if (defaultSpaceId != null) {
            s.setDefaultSpaceId(defaultSpaceId);
        }
        if (customTypes != null) {
            s.setCustomTypes(customTypes);
        }
        s.setUpdatedAt(LocalDateTime.now());
        return repo.save(s);
    }
}
