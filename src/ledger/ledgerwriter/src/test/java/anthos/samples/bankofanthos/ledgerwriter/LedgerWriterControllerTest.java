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

package anthos.samples.bankofanthos.ledgerwriter;

import static anthos.samples.bankofanthos.ledgerwriter.ExceptionMessages.EXCEPTION_MESSAGE_DUPLICATE_TRANSACTION;

import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.google.common.cache.Cache;
import io.micrometer.core.instrument.Clock;
import io.micrometer.core.instrument.binder.cache.GuavaCacheMetrics;
import io.micrometer.core.lang.Nullable;
import io.micrometer.stackdriver.StackdriverConfig;
import io.micrometer.stackdriver.StackdriverMeterRegistry;
import java.lang.reflect.Field;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.initMocks;

class LedgerWriterControllerTest {

    private LedgerWriterController controller;

    @Mock
    private JWTVerifier verifier;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private TransactionValidator transactionValidator;
    @Mock
    private DecodedJWT jwt;
    @Mock
    private Claim claim;
    @Mock
    private Transaction transaction;
    @Mock
    private Clock clock;

    private MockedStatic<GuavaCacheMetrics> guavaCacheMetricsMock;

    private static final String VERSION = "v0.0.0-test";
    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final String BALANCES_API_URI = "http://balances:8080/balances";
    private static final String BEARER_TOKEN = "Bearer token";
    private static final String TOKEN = "token";
    private static final String AUTHED_ACCOUNT_NUM = "1234567890";
    private static final String DUPLICATE_UUID = "duplicate-test-uuid";

    @BeforeEach
    void setUp() {
        initMocks(this);
        guavaCacheMetricsMock = mockStatic(GuavaCacheMetrics.class);

        StackdriverMeterRegistry meterRegistry = new StackdriverMeterRegistry(
            new StackdriverConfig() {
                @Override
                public boolean enabled() {
                    return false;
                }

                @Override
                public String projectId() {
                    return "test";
                }

                @Override
                @Nullable
                public String get(String key) {
                    return null;
                }
            }, clock);

        controller = new LedgerWriterController(
                verifier,
                meterRegistry,
                transactionRepository,
                transactionValidator,
                LOCAL_ROUTING_NUM,
                BALANCES_API_URI,
                VERSION);

        when(verifier.verify(TOKEN)).thenReturn(jwt);
        when(jwt.getClaim(LedgerWriterController.JWT_ACCOUNT_KEY)).thenReturn(claim);
        when(claim.asString()).thenReturn(AUTHED_ACCOUNT_NUM);
    }

    @AfterEach
    void tearDown() {
        guavaCacheMetricsMock.close();
    }

    @Test
    @DisplayName("Given version number in the environment, "
            + "return a ResponseEntity with the version number")
    void version() {
        final ResponseEntity actualResult = controller.version();

        assertNotNull(actualResult);
        assertEquals(VERSION, actualResult.getBody());
        assertEquals(HttpStatus.OK, actualResult.getStatusCode());
    }

    @Test
    @DisplayName("Given duplicate transaction UUID already in cache, "
            + "return HTTP Status 400")
    @SuppressWarnings("unchecked")
    void addTransactionFailsWhenDuplicateUuid() throws Exception {
        // Given
        Field cacheField =
                LedgerWriterController.class.getDeclaredField("cache");
        cacheField.setAccessible(true);
        Cache<String, Long> cache =
                (Cache<String, Long>) cacheField.get(controller);
        cache.put(DUPLICATE_UUID, 123L);
        when(transaction.getRequestUuid()).thenReturn(DUPLICATE_UUID);

        // When
        final ResponseEntity actualResult =
                controller.addTransaction(BEARER_TOKEN, transaction);

        // Then
        assertNotNull(actualResult);
        assertEquals(HttpStatus.BAD_REQUEST, actualResult.getStatusCode());
        assertEquals(EXCEPTION_MESSAGE_DUPLICATE_TRANSACTION,
                actualResult.getBody());
    }
}
