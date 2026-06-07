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

package anthos.samples.bankofanthos.transactionhistory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.MockitoAnnotations.initMocks;

import com.google.common.cache.LoadingCache;
import java.lang.reflect.Field;
import java.util.Deque;
import java.util.LinkedList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class TransactionCacheTest {

    private TransactionCache transactionCache;

    @Mock
    private TransactionRepository dbRepo;

    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final String ACCOUNT_ID = "1234567890";
    private static final int CACHE_SIZE = 100;
    private static final int CACHE_MINUTES = 30;
    private static final int HISTORY_LIMIT = 50;

    @BeforeEach
    void setUp() throws Exception {
        initMocks(this);
        transactionCache = new TransactionCache();

        Field dbRepoField = TransactionCache.class.getDeclaredField("dbRepo");
        dbRepoField.setAccessible(true);
        dbRepoField.set(transactionCache, dbRepo);
    }

    @Test
    @DisplayName("Given a valid account ID, the cache loader calls dbRepo.findForAccount with correct parameters")
    void cacheLoaderCallsRepoWithCorrectParameters() throws Exception {
        // Given
        LinkedList<Transaction> expectedTransactions = new LinkedList<>();
        when(dbRepo.findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), any(Pageable.class)))
            .thenReturn(expectedTransactions);

        LoadingCache<String, Deque<Transaction>> cache =
            transactionCache.initializeCache(CACHE_SIZE, CACHE_MINUTES, LOCAL_ROUTING_NUM, HISTORY_LIMIT);

        // When
        Deque<Transaction> result = cache.get(ACCOUNT_ID);

        // Then
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(dbRepo).findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), pageableCaptor.capture());

        Pageable capturedPageable = pageableCaptor.getValue();
        assertEquals(0, capturedPageable.getPageNumber());
        assertEquals(HISTORY_LIMIT, capturedPageable.getPageSize());
    }

    @Test
    @DisplayName("Given transactions exist in the repository, the cache returns them")
    void cacheReturnsTransactionsFromRepository() throws Exception {
        // Given
        LinkedList<Transaction> expectedTransactions = new LinkedList<>();
        expectedTransactions.add(new Transaction());
        expectedTransactions.add(new Transaction());
        when(dbRepo.findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), any(Pageable.class)))
            .thenReturn(expectedTransactions);

        LoadingCache<String, Deque<Transaction>> cache =
            transactionCache.initializeCache(CACHE_SIZE, CACHE_MINUTES, LOCAL_ROUTING_NUM, HISTORY_LIMIT);

        // When
        Deque<Transaction> result = cache.get(ACCOUNT_ID);

        // Then
        assertNotNull(result);
        assertSame(expectedTransactions, result);
        assertEquals(2, result.size());
    }

    @Test
    @DisplayName("Given a configured cache size, the cache is created with the expected maximum size")
    void cacheIsConfiguredWithExpectedMaxSize() throws Exception {
        // Given
        when(dbRepo.findForAccount(any(), any(), any(Pageable.class)))
            .thenReturn(new LinkedList<>());

        // When
        LoadingCache<String, Deque<Transaction>> cache =
            transactionCache.initializeCache(CACHE_SIZE, CACHE_MINUTES, LOCAL_ROUTING_NUM, HISTORY_LIMIT);

        // Then
        assertNotNull(cache);
        // Load entries up to and beyond the max size to verify eviction
        for (int i = 0; i < CACHE_SIZE + 10; i++) {
            cache.get("account-" + i);
        }
        // Allow eviction to complete
        cache.cleanUp();
        // The cache should not exceed the configured max size
        assert cache.size() <= CACHE_SIZE;
    }

    @Test
    @DisplayName("Given a configured expiration time, the cache uses time-based expiration")
    void cacheUsesTimeBasedExpiration() throws Exception {
        // Given
        LinkedList<Transaction> expectedTransactions = new LinkedList<>();
        when(dbRepo.findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), any(Pageable.class)))
            .thenReturn(expectedTransactions);

        // When - create cache with 0 minute expiry to force immediate expiration
        LoadingCache<String, Deque<Transaction>> cache =
            transactionCache.initializeCache(CACHE_SIZE, 0, LOCAL_ROUTING_NUM, HISTORY_LIMIT);

        // Then
        assertNotNull(cache);
        // Load the entry
        cache.get(ACCOUNT_ID);
        // Clean up expired entries
        cache.cleanUp();
        // With 0-minute expiry, the entry should be expired after cleanup
        assertEquals(0, cache.size());
    }

    @Test
    @DisplayName("Given cache has stats recording enabled, stats should be available")
    void cacheHasStatsRecordingEnabled() throws Exception {
        // Given
        when(dbRepo.findForAccount(any(), any(), any(Pageable.class)))
            .thenReturn(new LinkedList<>());

        LoadingCache<String, Deque<Transaction>> cache =
            transactionCache.initializeCache(CACHE_SIZE, CACHE_MINUTES, LOCAL_ROUTING_NUM, HISTORY_LIMIT);

        // When
        cache.get(ACCOUNT_ID);

        // Then
        assertNotNull(cache.stats());
        assertEquals(1, cache.stats().missCount());
        assertEquals(1, cache.stats().loadCount());
    }

    @Test
    @DisplayName("Given a cached entry, subsequent gets should return the cached value without hitting the repo again")
    void cacheReturnsCachedValueOnSubsequentGets() throws Exception {
        // Given
        LinkedList<Transaction> expectedTransactions = new LinkedList<>();
        expectedTransactions.add(new Transaction());
        when(dbRepo.findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), any(Pageable.class)))
            .thenReturn(expectedTransactions);

        LoadingCache<String, Deque<Transaction>> cache =
            transactionCache.initializeCache(CACHE_SIZE, CACHE_MINUTES, LOCAL_ROUTING_NUM, HISTORY_LIMIT);

        // When
        cache.get(ACCOUNT_ID);
        Deque<Transaction> secondResult = cache.get(ACCOUNT_ID);

        // Then
        assertSame(expectedTransactions, secondResult);
        // Verify the repo was only called once (first load), not on the cache hit
        verify(dbRepo).findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), any(Pageable.class));
        assertEquals(1, cache.stats().hitCount());
    }

    @Test
    @DisplayName("Given a custom history limit, the cache loader creates a PageRequest with that limit")
    void cacheLoaderUsesConfiguredHistoryLimit() throws Exception {
        // Given
        int customLimit = 25;
        when(dbRepo.findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), any(Pageable.class)))
            .thenReturn(new LinkedList<>());

        LoadingCache<String, Deque<Transaction>> cache =
            transactionCache.initializeCache(CACHE_SIZE, CACHE_MINUTES, LOCAL_ROUTING_NUM, customLimit);

        // When
        cache.get(ACCOUNT_ID);

        // Then
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(dbRepo).findForAccount(eq(ACCOUNT_ID), eq(LOCAL_ROUTING_NUM), pageableCaptor.capture());
        assertEquals(PageRequest.of(0, customLimit), pageableCaptor.getValue());
    }
}
