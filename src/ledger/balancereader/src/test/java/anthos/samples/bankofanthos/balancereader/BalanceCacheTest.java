/*
 * Copyright 2020, Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package anthos.samples.bankofanthos.balancereader;

import com.google.common.cache.LoadingCache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.initMocks;

class BalanceCacheTest {

    private BalanceCache balanceCache;

    @Mock
    private TransactionRepository dbRepo;

    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final Integer CACHE_SIZE = 100;
    private static final String ACCOUNT_ID = "1234567890";

    @BeforeEach
    void setUp() throws Exception {
        initMocks(this);
        balanceCache = new BalanceCache();

        // Inject the mocked dbRepo via reflection
        Field dbRepoField = BalanceCache.class.getDeclaredField("dbRepo");
        dbRepoField.setAccessible(true);
        dbRepoField.set(balanceCache, dbRepo);
    }

    @Test
    @DisplayName("Given dbRepo returns null, cache should return 0L for unknown account")
    void cacheReturnsZeroWhenDbReturnsNull() throws Exception {
        // Arrange
        when(dbRepo.findBalance(ACCOUNT_ID, LOCAL_ROUTING_NUM)).thenReturn(null);

        // Act
        LoadingCache<String, Long> cache =
            balanceCache.initializeCache(CACHE_SIZE, LOCAL_ROUTING_NUM);
        Long balance = cache.get(ACCOUNT_ID);

        // Assert
        assertEquals(0L, balance);
        verify(dbRepo).findBalance(ACCOUNT_ID, LOCAL_ROUTING_NUM);
    }

    @Test
    @DisplayName("Given dbRepo returns a non-null balance, cache should return that balance")
    void cacheReturnsActualBalanceFromDb() throws Exception {
        // Arrange
        Long expectedBalance = 5000L;
        when(dbRepo.findBalance(ACCOUNT_ID, LOCAL_ROUTING_NUM)).thenReturn(expectedBalance);

        // Act
        LoadingCache<String, Long> cache =
            balanceCache.initializeCache(CACHE_SIZE, LOCAL_ROUTING_NUM);
        Long balance = cache.get(ACCOUNT_ID);

        // Assert
        assertEquals(expectedBalance, balance);
        verify(dbRepo).findBalance(ACCOUNT_ID, LOCAL_ROUTING_NUM);
    }

    @Test
    @DisplayName("Cache is configured with the expected maximum size")
    void cacheHasExpectedMaxSize() throws Exception {
        // Arrange - use a small max size so we can verify eviction
        Integer maxSize = 2;
        when(dbRepo.findBalance(anyString(), eq(LOCAL_ROUTING_NUM))).thenReturn(100L);

        // Act
        LoadingCache<String, Long> cache =
            balanceCache.initializeCache(maxSize, LOCAL_ROUTING_NUM);

        // Load more entries than the max size
        cache.get("account1");
        cache.get("account2");
        cache.get("account3");

        // Force pending eviction maintenance
        cache.cleanUp();

        // Assert - cache size should not exceed the configured maximum
        assertTrue(cache.size() <= maxSize,
            "Cache size should not exceed maxSize=" + maxSize
                + " but was: " + cache.size());
    }
}
