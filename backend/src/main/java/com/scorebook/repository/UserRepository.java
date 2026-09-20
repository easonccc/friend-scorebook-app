package com.scorebook.repository;

import com.scorebook.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/**
 * 用户仓储（Spring Data JPA）。
 * 主键是 openid（字符串），所以泛型第二个参数是 String。
 */
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByOpenid(String openid);
}
