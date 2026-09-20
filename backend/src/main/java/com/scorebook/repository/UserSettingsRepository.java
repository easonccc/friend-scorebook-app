package com.scorebook.repository;

import com.scorebook.entity.UserSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserSettingsRepository extends JpaRepository<UserSettings, String> {

    Optional<UserSettings> findByOpenid(String openid);
}
