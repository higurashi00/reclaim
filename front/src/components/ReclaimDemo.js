import { useState } from 'react';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';
 
function ReclaimDemo() {
  const [requestUrl, setRequestUrl] = useState('');
  const [proofs, setProofs] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [userData, setUserData] = useState(null);
  const [serverVerification, setServerVerification] = useState(null);
 
  const getVerificationReq = async () => {
    // 環境変数から認証情報を取得
    const APP_ID = process.env.REACT_APP_RECLAIM_APP_ID;
    const APP_SECRET = process.env.REACT_APP_RECLAIM_APP_SECRET;
    const PROVIDER_ID = process.env.REACT_APP_RECLAIM_PROVIDER_ID;

    if (!APP_ID || !APP_SECRET || !PROVIDER_ID) {
      console.error('環境変数が設定されていません');
      return;
    }

    // Reclaim SDKを認証情報で初期化
    const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, PROVIDER_ID);
 
    // 認証リクエストURLを生成
    const requestUrl = await reclaimProofRequest.getRequestUrl();
    setRequestUrl(requestUrl);
 
    // プルーフの提出を監視開始
    await reclaimProofRequest.startSession({
      onSuccess: (proofs) => {
        setProofs(proofs);
        setIsVerified(true);
        
        try {
          // プルーフからユーザーデータを抽出
          let extractedData = null;
          
          // proofsが配列の場合
          if (Array.isArray(proofs) && proofs.length > 0) {
            if (proofs[0].publicData) {
              extractedData = {
                username: proofs[0].publicData.username || 'N/A',
                creationYear: proofs[0].publicData.creationYear || 'N/A',
                contributionsLastYear: proofs[0].publicData.contributionsLastYear || 'N/A'
              };
            }
          } 
          // proofsがpublicDataを持つオブジェクトの場合
          else if (proofs && proofs.publicData) {
            extractedData = {
              username: proofs.publicData.username || 'N/A',
              creationYear: proofs.publicData.creationYear || 'N/A',
              contributionsLastYear: proofs.publicData.contributionsLastYear || 'N/A'
            };
          }
          
          if (extractedData) {
            setUserData(extractedData);
          }
        } catch (error) {
          console.error('ユーザーデータの抽出中にエラーが発生しました:', error);
        }
      },
      onError: (error) => {
        console.error('認証に失敗しました', error);
      },
    });
  };

  // バックエンドにプルーフを送信して検証する関数
  const submitProofsToServer = async () => {
    if (!proofs) {
      console.error('プルーフが存在しません');
      return;
    }

    try {
      setServerVerification({ status: 'pending', message: '検証中...' });
      
      // 絶対URLを使用
      const backendUrl = 'http://localhost:3000/api/verify-proofs';
      console.log('バックエンドにプルーフを送信します...', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proofs }),
        // CORSリクエストのためのクレデンシャル設定
        credentials: 'include',
      });
      
      // レスポンスのステータスとテキストを確認
      console.log('レスポンスステータス:', response.status);
      const responseText = await response.text();
      console.log('レスポンステキスト:', responseText);
      
      // テキストが空でなく、JSONとして解析可能な場合のみパース
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('JSONパースエラー:', parseError);
        throw new Error(`レスポンスが無効なJSONです: ${responseText.substring(0, 100)}...`);
      }
      
      if (response.ok) {
        console.log('バックエンド検証成功:', result);
        setServerVerification({ 
          status: 'success', 
          message: 'バックエンドでの検証に成功しました',
          data: result
        });
      } else {
        console.error('バックエンド検証失敗:', result);
        setServerVerification({ 
          status: 'error', 
          message: `検証エラー: ${result.error || '不明なエラー'}` 
        });
      }
    } catch (error) {
      console.error('プルーフ送信中にエラーが発生しました:', error);
      setServerVerification({ 
        status: 'error', 
        message: `送信エラー: ${error.message}` 
      });
    }
  };
 
  return (
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '8px', 
      padding: '20px', 
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <button 
        onClick={getVerificationReq}
        style={{
          backgroundColor: '#4a6baf',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        認証リクエストを取得
      </button>

      {requestUrl && !isVerified && (
        <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ color: '#555', marginBottom: '15px' }}>このQRコードをスキャンして認証を完了してください</p>
          <QRCode value={requestUrl} />
        </div>
      )}

      {isVerified && (
        <div style={{ 
          margin: '20px 0', 
          padding: '15px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '4px',
          borderLeft: '4px solid #4caf50'
        }}>
          <h2 style={{ color: '#2e7d32', marginTop: 0 }}>ログインに成功しWeb証明を生成しました！</h2>
          
          {/* バックエンド検証ボタンを追加 */}
          <button
            onClick={submitProofsToServer}
            style={{
              backgroundColor: '#2e7d32',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              marginBottom: '15px'
            }}
          >
            バックエンドで検証する
          </button>

          {/* バックエンド検証結果の表示 */}
          {serverVerification && (
            <div style={{ 
              margin: '15px 0', 
              padding: '10px', 
              backgroundColor: serverVerification.status === 'success' ? '#e8f5e9' : 
                              serverVerification.status === 'error' ? '#ffebee' : '#fff8e1',
              borderRadius: '4px',
              borderLeft: `4px solid ${
                serverVerification.status === 'success' ? '#4caf50' : 
                serverVerification.status === 'error' ? '#f44336' : '#ffc107'
              }`
            }}>
              <p style={{ 
                color: serverVerification.status === 'success' ? '#2e7d32' : 
                      serverVerification.status === 'error' ? '#d32f2f' : '#ff8f00',
                margin: '0'
              }}>
                {serverVerification.message}
              </p>
              {serverVerification.data && (
                <details>
                  <summary style={{ cursor: 'pointer', marginTop: '10px' }}>サーバー検証詳細</summary>
                  <pre style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '10px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '14px'
                  }}>
                    {JSON.stringify(serverVerification.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
          
          {userData ? (
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '15px', 
              borderRadius: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '15px'
            }}>
              <h3 style={{ color: '#4a6baf', marginTop: 0 }}>Github プロフィール情報</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px', alignItems: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>ユーザーネーム：</div>
                <div>{userData.username}</div>
                
                <div style={{ fontWeight: 'bold' }}>Creation Year：</div>
                <div>{userData.creationYear}</div>
                
                <div style={{ fontWeight: 'bold' }}>Contribution Last Year：</div>
                <div>{userData.contributionsLastYear}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#d32f2f', marginBottom: '15px' }}>
              プロフィール情報を取得できませんでした。詳細データを確認してください。
            </div>
          )}
          
          <details>
            <summary style={{ cursor: 'pointer', color: '#555', marginBottom: '10px' }}>詳細データを表示</summary>
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '14px'
            }}>
              {JSON.stringify(proofs, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
 
export default ReclaimDemo;