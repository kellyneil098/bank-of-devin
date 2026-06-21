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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.exceptions.JWTVerificationException;
import io.micrometer.core.instrument.binder.cache.GuavaCacheMetrics;
import io.micrometer.stackdriver.StackdriverMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class LedgerWriterControllerTest {

    private static final String VERSION = "v0.0.0-test";
    private static final String LOCAL_ROUTING_NUM = "883745000";
    private static final String BALANCES_API_URI = "http://balances:8080/balances";
    private static final String BEARER_TOKEN = "Bearer validtoken";
    private static final String TOKEN = "validtoken";

    private JWTVerifier verifier;
    private StackdriverMeterRegistry meterRegistry;
    private TransactionRepository transactionRepository;
    private TransactionValidator transactionValidator;
    private LedgerWriterController controller;
    private MockedStatic<GuavaCacheMetrics> guavaCacheMetricsMock;

    @BeforeEach
    void setUp() {
        verifier = mock(JWTVerifier.class);
        meterRegistry = mock(StackdriverMeterRegistry.class);
        transactionRepository = mock(TransactionRepository.class);
        transactionValidator = mock(TransactionValidator.class);

        guavaCacheMetricsMock = mockStatic(GuavaCacheMetrics.class);

        controller = new LedgerWriterController(
                verifier,
                meterRegistry,
                transactionRepository,
                transactionValidator,
                LOCAL_ROUTING_NUM,
                BALANCES_API_URI,
                VERSION);
    }

    @AfterEach
    void tearDown() {
        guavaCacheMetricsMock.close();
    }

    @Test
    void version() {
        ResponseEntity<?> response = controller.version();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(VERSION, response.getBody());
    }

    @Test
    @DisplayName("Given JWT verification fails, return HTTP Status 401 UNAUTHORIZED")
    void addTransactionFailsWhenJWTVerificationFails() {
        // Given
        Transaction transaction = mock(Transaction.class);
        when(verifier.verify(TOKEN)).thenThrow(JWTVerificationException.class);

        // When
        final ResponseEntity<?> actualResult =
                controller.addTransaction(BEARER_TOKEN, transaction);

        // Then
        assertNotNull(actualResult);
        assertEquals(HttpStatus.UNAUTHORIZED, actualResult.getStatusCode());
        assertEquals(LedgerWriterController.UNAUTHORIZED_CODE, actualResult.getBody());
    }
}
