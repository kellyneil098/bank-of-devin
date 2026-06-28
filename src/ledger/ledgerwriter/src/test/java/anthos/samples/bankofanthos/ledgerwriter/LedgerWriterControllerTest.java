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

import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import io.micrometer.core.instrument.Clock;
import io.micrometer.core.instrument.binder.cache.GuavaCacheMetrics;
import io.micrometer.core.lang.Nullable;
import io.micrometer.stackdriver.StackdriverConfig;
import io.micrometer.stackdriver.StackdriverMeterRegistry;
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
    private Clock clock;
    @Mock
    private Transaction transaction;

    private MockedStatic<GuavaCacheMetrics> guavaCacheMetricsMock;

    private static final String VERSION = "v0.0.0-test";
    private static final String LOCAL_ROUTING_NUM = "123456789";
    private static final String BALANCES_API_URI = "http://balances:8080/balances";
    private static final String BEARER_TOKEN = "Bearer token";
    private static final String TOKEN = "token";
    private static final String AUTHED_ACCOUNT_NUM = "1234567890";

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
    @DisplayName("Given JWT verification fails, return HTTP Status 401")
    void addTransactionFailsWhenJWTVerificationFails() {
        // Given
        when(verifier.verify(TOKEN)).thenThrow(
                JWTVerificationException.class);

        // When
        final ResponseEntity actualResult =
                controller.addTransaction(BEARER_TOKEN, transaction);

        // Then
        assertNotNull(actualResult);
        assertEquals(HttpStatus.UNAUTHORIZED, actualResult.getStatusCode());
        assertEquals(LedgerWriterController.UNAUTHORIZED_CODE,
                actualResult.getBody());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }
}
