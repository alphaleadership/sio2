const EventEmitter = require('events');

/**
 * Système de queue en mémoire pour traiter les compressions en arrière-plan
 * Évite le blocage des uploads pendant la compression et gère les retry automatiques
 */
class CompressionQueue extends EventEmitter {
  /**
   * Constructeur de la queue de compression
   * @param {Object} options - Options de configuration
   * @param {number} options.maxConcurrent - Nombre maximum de compressions simultanées (défaut: 3)
   * @param {number} options.maxRetries - Nombre maximum de tentatives (défaut: 3)
   * @param {number} options.retryDelay - Délai entre les tentatives en ms (défaut: 1000)
   * @param {number} options.timeout - Timeout par tâche en ms (défaut: 30000)
   */
  constructor(options = {}) {
    super();
    
    this.maxConcurrent = options.maxConcurrent || 3;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
    
    // Queue des tâches en attente
    this.pendingTasks = [];
    
    // Tâches en cours d'exécution
    this.activeTasks = new Map();
    
    // Compteurs et statistiques
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      currentActive: 0,
      currentPending: 0
    };
    
    // État de la queue
    this.isRunning = true;
    
    // Démarrer le processeur de queue
    this.processQueue();
  }

  /**
   * Ajoute une tâche de compression à la queue
   * @param {Object} task - Tâche de compression
   * @param {string} task.id - Identifiant unique de la tâche
   * @param {string} task.inputPath - Chemin du fichier source
   * @param {string} task.outputPath - Chemin du fichier de sortie
   * @param {Object} task.options - Options de compression
   * @param {Function} task.compressionFunction - Fonction de compression à exécuter
   * @param {Object} task.metadata - Métadonnées additionnelles
   * @returns {Promise<Object>} Promise qui se résout avec le résultat de la compression
   */
  async addTask(task) {
    return new Promise((resolve, reject) => {
      // Valider la tâche
      if (!task.id || !task.inputPath || !task.outputPath || !task.compressionFunction) {
        return reject(new Error('Tâche invalide: propriétés requises manquantes'));
      }

      // Créer l'objet tâche complet
      const queueTask = {
        ...task,
        retries: 0,
        createdAt: new Date(),
        status: 'pending',
        resolve,
        reject,
        timeoutId: null
      };

      // Ajouter à la queue
      this.pendingTasks.push(queueTask);
      this.stats.totalQueued++;
      this.stats.currentPending = this.pendingTasks.length;

      // Émettre l'événement de nouvelle tâche
      this.emit('taskQueued', {
        taskId: task.id,
        queueLength: this.pendingTasks.length,
        activeCount: this.activeTasks.size
      });

      // Déclencher le traitement si possible
      this.processQueue();
    });
  }

  /**
   * Processeur principal de la queue
   * Traite les tâches en respectant la limite de concurrence
   */
  async processQueue() {
    // Vérifier si on peut traiter plus de tâches
    while (this.isRunning && 
           this.activeTasks.size < this.maxConcurrent && 
           this.pendingTasks.length > 0) {
      
      const task = this.pendingTasks.shift();
      this.stats.currentPending = this.pendingTasks.length;
      
      // Démarrer le traitement de la tâche
      this.processTask(task);
    }
  }

  /**
   * Traite une tâche individuelle
   * @param {Object} task - Tâche à traiter
   */
  async processTask(task) {
    // Ajouter aux tâches actives
    this.activeTasks.set(task.id, task);
    task.status = 'processing';
    task.startedAt = new Date();
    
    this.stats.currentActive = this.activeTasks.size;

    // Configurer le timeout
    task.timeoutId = setTimeout(() => {
      this.handleTaskTimeout(task);
    }, this.timeout);

    // Émettre l'événement de début de traitement
    this.emit('taskStarted', {
      taskId: task.id,
      inputPath: task.inputPath,
      outputPath: task.outputPath,
      attempt: task.retries + 1
    });

    try {
      // Exécuter la fonction de compression
      const result = await task.compressionFunction(
        task.inputPath,
        task.outputPath,
        task.options || {}
      );

      // Succès - nettoyer et résoudre
      this.completeTask(task, result, null);

    } catch (error) {
      // Échec - gérer le retry ou l'échec final
      this.handleTaskError(task, error);
    }
  }

  /**
   * Gère le timeout d'une tâche
   * @param {Object} task - Tâche qui a timeout
   */
  handleTaskTimeout(task) {
    const error = new Error(`Timeout de compression après ${this.timeout}ms`);
    error.code = 'COMPRESSION_TIMEOUT';
    
    this.handleTaskError(task, error);
  }

  /**
   * Gère les erreurs de tâche et les retry
   * @param {Object} task - Tâche en erreur
   * @param {Error} error - Erreur rencontrée
   */
  async handleTaskError(task, error) {
    // Nettoyer le timeout
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
      task.timeoutId = null;
    }

    task.retries++;
    task.lastError = error;

    // Émettre l'événement d'erreur
    this.emit('taskError', {
      taskId: task.id,
      error: error.message,
      attempt: task.retries,
      maxRetries: this.maxRetries
    });

    // Vérifier si on peut retry
    if (task.retries < this.maxRetries) {
      // Programmer un retry
      task.status = 'retrying';
      
      setTimeout(() => {
        // Remettre en queue pour retry
        this.pendingTasks.unshift(task);
        this.stats.currentPending = this.pendingTasks.length;
        
        // Retirer des tâches actives
        this.activeTasks.delete(task.id);
        this.stats.currentActive = this.activeTasks.size;
        
        // Relancer le traitement
        this.processQueue();
      }, this.retryDelay * task.retries); // Délai exponentiel
      
    } else {
      // Échec final
      this.completeTask(task, null, error);
    }
  }

  /**
   * Complète une tâche (succès ou échec final)
   * @param {Object} task - Tâche à compléter
   * @param {Object} result - Résultat en cas de succès
   * @param {Error} error - Erreur en cas d'échec final
   */
  completeTask(task, result, error) {
    // Nettoyer le timeout
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
      task.timeoutId = null;
    }

    // Retirer des tâches actives
    this.activeTasks.delete(task.id);
    this.stats.currentActive = this.activeTasks.size;

    // Mettre à jour les statistiques
    this.stats.totalProcessed++;
    
    if (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      this.stats.totalFailed++;
      
      // Émettre l'événement d'échec final
      this.emit('taskFailed', {
        taskId: task.id,
        error: error.message,
        attempts: task.retries,
        duration: task.completedAt - task.startedAt
      });
      
      // Rejeter la promise
      task.reject(error);
      
    } else {
      task.status = 'completed';
      task.completedAt = new Date();
      this.stats.totalSucceeded++;
      
      // Émettre l'événement de succès
      this.emit('taskCompleted', {
        taskId: task.id,
        result,
        attempts: task.retries + 1,
        duration: task.completedAt - task.startedAt
      });
      
      // Résoudre la promise
      task.resolve(result);
    }

    // Continuer le traitement de la queue
    this.processQueue();
  }

  /**
   * Obtient le statut d'une tâche
   * @param {string} taskId - Identifiant de la tâche
   * @returns {Object|null} Statut de la tâche ou null si non trouvée
   */
  getTaskStatus(taskId) {
    // Chercher dans les tâches actives
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      return {
        id: taskId,
        status: activeTask.status,
        retries: activeTask.retries,
        createdAt: activeTask.createdAt,
        startedAt: activeTask.startedAt
      };
    }

    // Chercher dans les tâches en attente
    const pendingTask = this.pendingTasks.find(t => t.id === taskId);
    if (pendingTask) {
      return {
        id: taskId,
        status: 'pending',
        retries: pendingTask.retries,
        createdAt: pendingTask.createdAt,
        queuePosition: this.pendingTasks.indexOf(pendingTask) + 1
      };
    }

    return null;
  }

  /**
   * Obtient les statistiques de la queue
   * @returns {Object} Statistiques complètes
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      activeTasks: Array.from(this.activeTasks.keys()),
      pendingTaskIds: this.pendingTasks.map(t => t.id),
      successRate: this.stats.totalProcessed > 0 ? 
        (this.stats.totalSucceeded / this.stats.totalProcessed) * 100 : 0
    };
  }

  /**
   * Pause la queue (arrête le traitement de nouvelles tâches)
   */
  pause() {
    this.isRunning = false;
    this.emit('queuePaused');
  }

  /**
   * Reprend la queue
   */
  resume() {
    this.isRunning = true;
    this.emit('queueResumed');
    this.processQueue();
  }

  /**
   * Vide la queue (annule toutes les tâches en attente)
   * @returns {number} Nombre de tâches annulées
   */
  clear() {
    const cancelledCount = this.pendingTasks.length;
    
    // Rejeter toutes les tâches en attente
    this.pendingTasks.forEach(task => {
      task.reject(new Error('Tâche annulée - queue vidée'));
    });
    
    this.pendingTasks = [];
    this.stats.currentPending = 0;
    
    this.emit('queueCleared', { cancelledTasks: cancelledCount });
    
    return cancelledCount;
  }

  /**
   * Arrête complètement la queue et annule toutes les tâches
   */
  async shutdown() {
    this.isRunning = false;
    
    // Annuler toutes les tâches en attente
    this.clear();
    
    // Attendre que les tâches actives se terminent ou les forcer à s'arrêter
    const activeTaskIds = Array.from(this.activeTasks.keys());
    
    // Donner un délai pour que les tâches actives se terminent
    await new Promise(resolve => {
      if (this.activeTasks.size === 0) {
        resolve();
        return;
      }
      
      const checkInterval = setInterval(() => {
        if (this.activeTasks.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout de 5 secondes pour l'arrêt forcé
      setTimeout(() => {
        clearInterval(checkInterval);
        
        // Forcer l'arrêt des tâches restantes
        this.activeTasks.forEach(task => {
          if (task.timeoutId) {
            clearTimeout(task.timeoutId);
          }
          task.reject(new Error('Queue arrêtée - tâche interrompue'));
        });
        
        this.activeTasks.clear();
        resolve();
      }, 5000);
    });
    
    this.emit('queueShutdown');
  }
}

module.exports = CompressionQueue;